import { Interface } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const collections = [
    '0xabfae8a54e6817f57f9de7796044e9a60e61ad67', // Bonkler
    '0x5af0d9827e0c53e4799bb226655a1de152a425a5', // Milady
    '0x8a45fb65311ac8434aad5b8a93d1eba6ac4e813b', // Milady333
    '0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab', // Remilio
    '0x09f66a094a0070ebddefa192a33fa5d75b59d46b', // Yayo
    '0x8fc0d90f2c45a5e7f94904075c952e0943cfccfd', // Pixelady
    // '0x1352149cd78d686043b504e7e7d96c5946b0c39c', // Banners
    // '0x285ea754d9418073cc87994f1de143f918551390', // Remix
  ]

  const registry = await deployments.get('ENSRegistry')

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

  for (let index = 0; index < collections.length; index++) {
    const collection = collections[index]

    const isAdded = await RemiliasRegistrarControllerContract.nftContracts(
      collection,
    )
    if (!isAdded) {
      const tx = await RemiliasRegistrarControllerContract.addCollection(collection)
      console.log(
        `Adding collection(${collection}) on registrarController (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }
}

func.id = 'name-wrapper'
func.tags = ['init']
func.dependencies = [
  'RemiliasNameWrapper',
  'RemiliasResolver',
  'RemiliasPublicResolver',
  'RemiliasRegistrarController',
]

export default func
