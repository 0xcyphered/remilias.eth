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

  const registry = await deployments.get('ENSRegistry')
  const registrar = await deployments.get('RemiliasRegistrar')
  const registrarContract = await ethers.getContractAt(
    registrar.abi,
    registrar.address,
  )
  const metadata = await deployments.get('StaticMetadataService')
  const deployArgs = {
    from: owner,
    args: [registry.address, registrar.address, metadata.address],
    log: true,
  }

  const nameWrapper = await deploy('RemiliasNameWrapper', deployArgs)
  const isController = await registrarContract.controllers(nameWrapper.address)
  if (!isController) {
    const tx = await registrarContract.addController(nameWrapper.address)
    console.log(
      `Adding RemiliasNameWrapper as controller on registrar (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  // const RemiliasRegistrarController = await deployments.get(
  //   'RemiliasRegistrarController',
  // )
  // const RemiliasNameWrapper = await deployments.get('RemiliasNameWrapper')
  // const remiliasNameWrapper = await ethers.getContractAt(
  //   RemiliasNameWrapper.abi,
  //   RemiliasNameWrapper.address,
  // )

  // if (
  //   !(await remiliasNameWrapper.controllers(
  //     RemiliasRegistrarController.address,
  //   ))
  // ) {
  //   const tx = await remiliasNameWrapper.addController(
  //     RemiliasRegistrarController.address,
  //   )
  //   console.log(
  //     `Adding RemiliasRegistrarController as controller on RemiliasNameWrapper (tx: ${tx.hash})...`,
  //   )
  //   await tx.wait()
  // }

  if (owner !== deployer) {
    const NameWrapper = await deployments.get('NameWrapper')
    const wrapper = await ethers.getContractAt(
      NameWrapper.abi,
      NameWrapper.address,
    )
    const tx = await wrapper.transferOwnership(owner)
    console.log(
      `Transferring ownership of NameWrapper to ${owner} (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }
}

func.id = 'name-wrapper'
func.tags = ['wrapper', 'RemiliasNameWrapper']
func.dependencies = ['RemiliasRegistrar', 'StaticMetadataService']

export default func
