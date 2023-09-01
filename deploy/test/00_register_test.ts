import { Interface } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import namehash from 'eth-ens-namehash'
import { keccak256 } from 'js-sha3'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner, test } = await getNamedAccounts()
  const [_deployer, _whale] = await ethers.getSigners()

  const registry = await deployments.get('ENSRegistry')
  const registryContract = await ethers.getContractAt(
    registry.abi,
    registry.address,
  )
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)
  const remiliasPublicResolver = await deployments.get('RemiliasPublicResolver')
  const registrar = await deployments.get('RemiliasRegistrar')
  const registrarContract = await ethers.getContractAt(
    registrar.abi,
    registrar.address,
  )
  const RemiliasRegistrarController = await deployments.get(
    'RemiliasRegistrarController',
  )
  const RemiliasRegistrarControllerContract = await ethers.getContractAt(
    RemiliasRegistrarController.abi,
    RemiliasRegistrarController.address,
  )

  const RemiliasNameWrapper = await deployments.get('RemiliasNameWrapper')
  const remiliasNameWrapper = await ethers.getContractAt(
    RemiliasNameWrapper.abi,
    RemiliasNameWrapper.address,
  )

  const nodeHash = namehash.hash('remilias.eth')
  const nodeOwner = await registryContract.owner(nodeHash)

  if (nodeOwner === registrar.address) {
    console.log(`Starting tests...`)
    {
      const tx = await RemiliasRegistrarControllerContract.register(
        'test',
        deployer,
        '0x8fc0d90f2c45a5e7f94904075c952e0943cfccfd',
        4176,
        remiliasPublicResolver.address,
        [],
      )
      console.log(`Registering domain (tx: ${tx.hash})...`)
      await tx.wait()
    }
    {
      const tx = await reverseRegistrar.setNameForAddr(
        owner,
        owner,
        remiliasPublicResolver.address,
        'test.remilias.eth',
      )
      console.log(`setting ReverseRegistrar domain (tx: ${tx.hash})...`)
      await tx.wait()
    }
    {
      const tx = await registrarContract.approve(
        remiliasNameWrapper.address,
        '0x' + keccak256('test'),
      )
      console.log(`Approving nameWrapper (tx: ${tx.hash})...`)
      await tx.wait()
    }
    {
      const tx = await remiliasNameWrapper.wrapRemilias2LD(
        'test',
        deployer,
        0,
        remiliasPublicResolver.address,
      )
      console.log(`Wrapping domain (tx: ${tx.hash})...`)
      await tx.wait()
    }
    {
      const nftContract = await ethers.getContractAt(
        'ERC721',
        '0x8fc0d90f2c45a5e7f94904075c952e0943cfccfd',
      )
      await nftContract.transferFrom(deployer, _whale.address, 4176)
      const tx = await RemiliasRegistrarControllerContract.connect(
        _whale,
      ).resetOwner('0x8fc0d90f2c45a5e7f94904075c952e0943cfccfd', 4176)
      console.log(`resetting domain owner (tx: ${tx.hash})...`)
      await tx.wait()
    }
    {
      const tx = await remiliasNameWrapper
        .connect(_whale)
        .unwrapRemilias2LD(
          '0x' + keccak256('test'),
          _whale.address,
          _whale.address,
        )
      console.log(`UnWrapping domain (tx: ${tx.hash})...`)
      await tx.wait()
    }
  }
}

func.id = 'name-wrapper'
func.tags = ['test']
func.dependencies = ['init', 'test']

export default func
